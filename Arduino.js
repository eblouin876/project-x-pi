const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const log = require("con-logger");
const moment = require("moment");
const Response = require("./Response");

class Arduino {
    /**
     *
     * @param {String} comName Address of the comport the device is connected to
     * @param {String} serialNumber Unique serial number of the device that is created by the manufacturer
     * @param {String} deviceId assigned by the rPi
     */
    constructor(comName, serialNumber, deviceId, schedule, plantName, active = true) {
        this.comName = comName;
        this.serialNumber = serialNumber;
        this.plantName = plantName ? plantName : "";
        this.schedule = schedule ? schedule : [];
        this.deviceId = deviceId ? deviceId : 0;
        this.serialPort;
        this.parser;
        this.status = 2; // 0 is good, 1 is error, 2 is unassigned
        this.waterOnTimers = [];
        this.waterOffTimers = [];
        this.data;
        this.version = 1;
        this.companyId = 123;
        this.active = active;
    }

    // Method that sets the watering schedule whenever a new schedule comes in from the database
    // Will clear previous timers, take in the object, parse it, and  set intervals based on the input
    setWateringSchedule() {
        const week = 604800000;
        const conversion = 100; // TODO: This needs to be our conversion factor from cup to time in ms
        this.schedule.forEach(waterInstance => {
                let time = waterInstance.day + waterInstance.time;
                let duration = waterInstance.amount * conversion;
                let timeUntil = moment.duration(moment(time, "ddd hh:mm").diff(moment())).asMilliseconds();
                if (timeUntil < 0) {
                    timeUntil = week + timeUntil;
                }
                setTimeout(() => {
                    this.waterOnTimers.push(setInterval(() => {
                        this.startWater();
                    }, week))
                }, timeUntil);
                setTimeout(() => {
                    this.waterOffTimers.push(setInterval(() => {
                        this.stopWater();
                    }, week))
                }, timeUntil + duration);
            }
        )
    }

// Clears the watering schedule
    clearWateringSchedule() {
        for (let i = 0; i < this.waterOnTimers.length; i++) {
            clearInterval(this.waterOnTimers[i])
        }
        for (let i = 0; i < this.waterOffTimers.length; i++) {
            clearInterval(this.waterOffTimers[i])
        }
    }

// Method that returns the status of all connected devices and their data as an object and updates this.data
    reportSensors() {
        let command = 1;
        let checksum = this._generateChecksum(command);
        log(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}>`);
        this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}>`)
    }

// Method that sends command to the arduino to turn the pump on
    startWater() {
        let command = 3;
        let checksum = this._generateChecksum(command, 1);
        log(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~1>`);
        this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~1>`)
    }

// Method that sends command to the arduino to turn the pump off
    stopWater() {
        let command = 3;
        let checksum = this._generateChecksum(command, 0);
        log(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~0>`);
        this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~0>`)
    }

// Method that sets the deviceId for the arduino based on this.deviceId
    setDeviceId(DID) {
        let command = 4;
        this.deviceId = 255;
        let checksum = this._generateChecksum(command, DID);
        let deviceId = DID;
        log(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~${deviceId}>`);
        this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}~${deviceId}>`);
        this.deviceId = deviceId;
    }

// Method that returns a value (representing the bits) for what sensors are attached
    getSystemConfig() {
        let command = 5;
        let checksum = this._generateChecksum(command);
        log(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}>`);
        this.serialPort.write(`<${checksum}~${this.version}~${this.companyId}~${this.deviceId}~${command}>`)
    }

// Method that generates checksum
    _generateChecksum(cmd, data = "0") {
        return parseInt(this.version) + parseInt(this.companyId) + parseInt(this.deviceId) + parseInt(cmd) + parseInt(data);
    }

// Method that initializes the serialport and parser. Must be called to initialize setup async
    setup() {
        if(this.active){
            this.response = new Response(this.deviceId);
            this.serialPort = new SerialPort(this.comName);
            this.parser = this.serialPort.pipe(new Readline());
            this.parser.on("data", (res) => {
                data = this.response.handle(res);
                console.log(data)
                //    TODO: DO SOMETHING WITH THE DATA
            });

            return new Promise((resolve, reject) => {
                let parser = this.serialPort.pipe(new Readline());
                let ping = setInterval(() => this.getSystemConfig(), 1000);
                parser.on("data", data => {
                    let dataArr = data.split("~");
                    if (dataArr[4] === "5" && dataArr[5] > 0) {
                        this.status = parseInt(dataArr[1]);
                    } else {
                        log(data);
                    }
                });

                let check = setInterval(() => {
                    if (this.status > 0) {
                        clearInterval(check);
                        clearInterval(ping);
                        resolve(0);
                    }
                }, 500);

                setTimeout(() => reject("timeout"), 5000);
            })
        }
    }
}

module.exports = Arduino;