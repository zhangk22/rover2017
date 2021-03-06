var express = require('express');
var fetch = require('node-fetch');
var _ = require('lodash');
var net = require('net');

var client = undefined; // arduino tcp client

function init(model, config) {
    model.drive = {
        speed: [
            0, 0
        ], // -255 to 255
        pivot: 0,
        drive_mode: true, // drive mode vs pivot mode
        ebrake: false
    }

    var router = express.Router();

    // gets rover speed and turning parameters
    router.get('/', (req, res) => {
        res.json(model.drive);
    })

    // sets rover forward speed.
    router.put('/speed/:speed', (req, res) => {
        if(!model.drive.ebrake) {
          model.drive.speed[0] = model.drive.speed[1] = parseInt(req.params.speed);
          model.drive.drive_mode = true;
          res.json(model.drive);
        } else {
          res.status(500).send("EBrake Enabled")
        }

    });

    // sets rover speed on both wheels.
    router.put('/speed/:speed0/:speed1', (req, res) => {
        if(!model.drive.ebrake) {
          model.drive.speed[0] = parseInt(req.params.speed0);
          model.drive.speed[1] = parseInt(req.params.speed1);
          model.drive.drive_mode = true;
          res.json(model.drive);
        } else {
          res.status(500).send("EBrake Enabled")
        }

    });

    // sets the pivot speed of the rover. pivoting requires us to turn off
    // the middle wheels or the rocker bogie dies.
    router.put('/pivot/:turn_speed', (req, res) => {
      if(!model.drive.ebrake) {
        model.drive.pivot = parseInt(req.params.turn_speed);
        model.drive.drive_mode = false;
        res.json(model.drive);
      } else {
        res.status(500).send("EBrake Enabled")
      }

    });

    router.put('/stop', (req, res) => {
        model.drive.speed[0] = model.drive.speed[1] = 0;
        model.drive.pivot = 0;
        res.json(model.drive);
    });

    router.get('/ebrake', (req, res) => {
      res.json(model.drive);
    });

    router.put('/ebrake', (req, res) => {
      if (model.drive.ebrake) {
        model.drive.ebrake = false;
        model.drive.speed[0] = model.drive.speed[1] = 0;
        model.drive.pivot = 0;
      } else {
        model.drive.ebrake = true;
        model.drive.speed[0] = model.drive.speed[1] = 0;
        model.drive.pivot = 0;
      }
      res.json(model.drive);
    });

    // start an http connection with the arduino
    router.get('/ethernet', (req, res) => {
        fetch('http://192.168.0.177').then((response) => {
            if (response.ok) {
                console.log('Get Ethernet');
                res.json(response);
            }
            res.json({error: "ethernet request failed"});
        }).catch(function(err) {
            console.log('error', err);
        });
    });

    // start the tcp connection
    router.get('/tcp', (req, res) => {
      connectViaTCP();
      res.json(model.drive);
    });

    connectViaTCP = function() {
      if (client)
          client.destroy(); // reset the connection if applicable

      console.log('--> connecting to tcp on drive arduino');
      client = net.connect(config.drive_port, config.drive_ip, () => {
          console.log('--> connected to tcp on drive arduino');
      });
      enableClientListeners();

    }

    enableClientListeners = function(){
      //handling ETIMEDOUT error
      client.on('error', (e) => {
          console.log(e.code);
          if (e.code == 'ETIMEDOUT') {
              console.log('--> Unable to Connect/Disconnected from drive arduino');
              connectViaTCP();
          }
      });

      client.on('data', function(data) {
          console.log('received data from client');
      });
    }


    // send the current state of the rover over tcp
    sendState = function() {
        if (client && client.writable) {
            client.write(`${_.padStart(model.drive.speed[0], 5)}${_.padStart(model.drive.speed[1], 5)}${_.padStart(model.drive.pivot, 4)}${_.toNumber(model.drive.drive_mode)}`);
        }
    }
    setInterval(sendState, 200);

    console.log('-> drive server started');
    return router;
}

module.exports = {
    init
};
