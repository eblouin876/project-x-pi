const SerialPort = require("serialport");
const Delimiter = require("@serialport/parser-delimiter");
const log = require("con-logger");
const moment = require("moment");
const Response = require("./Response");

class Arduino {
    /**
     *
     * @param {String} comName Address of the comport the device is connected to
     * @param {String} serialNumber Unique serial number of the device that is created by the manufacturer
     * @param {String} deviceId assigned by the rPi
     * @param {[{amount: String, day: String, time: String}]} schedule Schedule set for this arduino
     * @param {String} plantName Name of the plant associated with this arduino instance
     * @param {boolean} active Describes the state of the arduino (active if plugged in and responding)
     */
    constructor(comName, serialNumber, deviceId, schedule, plantName, active = true) {
        this.comName = comName;
        this.serialNumber = serialNumber;
        this.plantName = plantName ? plantName : "";
        this.schedule = schedule ? schedule : [];
        this.deviceId = deviceId ? deviceId : 0;
        this.serialPort; // Holds the serialPort object that is used for communication to the arduinos
        this.parser; // Holds the parser object that will read the messages received from the arduino
        this.status = 2; // 0 is good, 1 is error, 2 is unassigned
        this.waterOnTimers = []; // Holds the timers that turn the water on
        this.waterOffTimers = []; // Holds the timers that turn the water off
        this.data; // Will hold the data that is returned from the devices attached to the arduino
        this.version = 1;
        this.companyId = 123;
        this.active = active;
        this.incoming = "";
        this.command = "";
    }

    // Method that sets the watering schedule whenever a new schedule comes in from the database
    // Will clear previous timers, take in the object, parse it, and  set intervals based on the input
    setWateringSchedule() {
        const week = 604800000; // Length of a week in milliseconds
        const conversion = 132000; // Based on 1c per 2min 12sec (132000 milliseconds/1 cup)
        this.schedule.forEach(waterInstance => {
                let time = waterInstance.day + waterInstance.time; // Makes a string that can be used by moment
                let duration = waterInstance.amount * conversion; // Uses the conversion to change amount to time in ms
                let timeUntil = moment.duration(moment(time, "ddd hh:mm").diff(moment())).asMilliseconds(); // Calculates the time in milliseconds to the time
                // If the value is less than 0, that means it has already passed this week. If we add that value to a week, it will give us the duration
                // to that point next week
                if (timeUntil < 0) {
                    timeUntil = week + timeUntil;
                }
                // This timeout will fire off when we hit time until (the first instance that watering should occur)
                setTimeout(() => {
                    // Call startWater here because the interval won't fire until it runs through once
                    this.startWater();
                    // Set an interval that runs once a week at the same time
                    this.waterOnTimers.push(setInterval(() => {
                        log("starting water");
                        this.startWater();
                    }, week))
                }, timeUntil);
                // This timeout will fire off when we hit time until (the first instance that watering should occur) PLUS the duration of watering
                setTimeout(() => {
                    // Call stopWater here to stop the initial watering
                    this.stopWater();
                    // A weekly interval at the same time that will turn the water off
                    this.waterOffTimers.push(setInterval(() => {
                        log("stopping water");
                        this.stopWater();
                    }, week))
                }, timeUntil + duration);
            }
        )
    }

// Clears all of the intervals for the watering schedule
    clearWateringSchedule() {
        for (let i = 0; i < this.waterOnTimers.length; i++) {
            clearInterval(this.waterOnTimers[i])
        }
        for (let i = 0; i < this.waterOffTimers.length; i++) {
            clearInterval(this.waterOffTimers[i])
        }
    }

// Method that asks for the status of all connected devices and their data as an object
    reportSensors() {
        let command = 1;
        let checksum = this._generateChecksum(command);
        log(`<${checksum}~${this.version}~${this.companyId}~255~${command}>`); //TODO: REMOVE before prod
        if (this.serialPort) {
            this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~255~${command}>`)
        }
    }

// Method that sends command to the arduino to turn the pump on
    startWater() {
        let command = 3;
        let checksum = this._generateChecksum(command, 1, 255);
        log(`<${checksum}~${this.version}~${this.companyId}~255~${command}~1>`); //TODO: REMOVE before prod
        if (this.serialPort) {
            this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~255~${command}~1>`)
        }
    }

// Method that sends command to the arduino to turn the pump off
    stopWater() {
        let command = 3;
        let checksum = this._generateChecksum(command, 0);
        log(`<${checksum}~${this.version}~${this.companyId}~255~${command}~0>`); //TODO: REMOVE before prod
        if (this.serialPort) {
            this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~255~${command}~0>`)
        }
    }

// Method that sets the deviceId for the arduino based on this.deviceId
    setDeviceId(DID) {
        let command = 4;
        let checksum = this._generateChecksum(command, DID);
        let deviceId = DID;
        log(`<${checksum}~${this.version}~${this.companyId}~255~${command}~${deviceId}>`); //TODO: REMOVE before prod
        if (this.serialPort) {
            this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~255~${command}~${deviceId}>`);
        }
    }

// Method that requests a value (representing the bits) for what sensors are attached
    getSystemConfig() {
        let command = 5;
        let checksum = this._generateChecksum(command);
        log(`<${checksum}~${this.version}~${this.companyId}~255~${command}>`); //TODO: REMOVE before prod
        if (this.serialPort) {
            this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~255~${command}>`)
        }
    }

    /**
     *
     * @description Method that generates a checksum (the value of all the integers in the message, which will be used for validation)
     * @param {String} cmd The integer representing the command that will be called
     * @param {[String]} data The data being passed in as a coomand. Will default to 0 and will handle summing an array of ints or strings
     * @param {String} deviceId The device id being used for the command (either the unique ID or 255). Will default to 255
     * @returns {number}
     * @private
     */
    _generateChecksum(cmd, data, deviceId = "255") {
        data = data ? data : "0"; // If data is passed in, it will be that value, otherwise it defaults to 0
        // If data is an array, this will sum all the values in the array and set data equal to the new value
        if (Array.isArray(data)) data = data.reduce((a, b) => a + b);
        return parseInt(this.version) + parseInt(this.companyId) + parseInt(deviceId) + parseInt(cmd) + parseInt(data);
    }

// Method that initializes the serialport and parser. Must be called after constructor to initialize setup asynchronously
    setup() {
        // Only runs setup if this instance of the arduino is active (i.e. plugged in and responding)
        if (this.active) {
            // Creates a new instance of the response handler
            this.response = new Response(this.deviceId);
            // Opens a new serial port to the assigned address
            this.serialPort = new SerialPort(this.comName);
            // Sets up a new parser to read commands that end with a ">"
            this.serialPort.on("readable", () => {
                let message = this.serialPort.read().toString();
                // Sends the data to the response handler to parse and send back
                if(!this.incoming && message[0]==="<") {
                    this.incoming = message;
                } else if(this.incoming) {
                    this.incoming += message;
                    if(this.incoming[this.incoming.length -1] === ">"){
                        this.command = this.incoming.slice(1,-1);
                        this.incoming = "";
                        console.log("ARDUINO 170:",this.command);
                        let data = this.response.handle(this.command);
                        console.log("ARDUINO DATA 172:",data)
                    }
                }

                // data = this.response.handle(data);
                // console.log("DATA Arduino:161", this.serialPort.read().toString())
                // TODO: DO SOMETHING WITH THE DATA
            });
            // Returns a promise that resolves if it gets a ping back from the arduino and rejects after a 5s timeout
            return new Promise((resolve, reject) => {
                // Sets a new instance of the listener that handles this specific case
                // let parser = this.serialPort.pipe(new Delimiter({delimiter: ">"}));
                // Sends a ping to the attached arduino to get its system config
                let ping = setInterval(() => this.getSystemConfig(), 1000);
                // parser.on("data", data => {
                //     let dataArr = data.split("~");
                //     // Checks the response for the command received being 5 and for a status > 0 TODO: Update  this to match the document. good shold be 0
                //     if (dataArr[4] === "5" && dataArr[5] > 0) {
                //         this.status = parseInt(dataArr[1]);
                //     } else {
                //         log(data);
                //     }
                // });
                // Sets an interval that will resolve on status change, waiting  for an  ack from the arduino
                let check = setInterval(() => {
                    if (this.status > 0) {
                        clearInterval(check);
                        clearInterval(ping);
                        resolve(this.status);
                    }
                }, 500);
                //  Timeout if nothing happens
                setTimeout(() => reject("timeout"), 5000);
            })
        }

    }
}

module.exports = Arduino;