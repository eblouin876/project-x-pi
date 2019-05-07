const Pusher = require("./Pusher");
const Arduino = require("./Arduino");
const log = require("con-logger");
const SerialPort = require("serialport");
const axios = require("axios");
const inquirer = require("inquirer");
const wifi = require("node-wifi");

class Pi {


    constructor() {
        this.arduinos = [];
        this.status = 0;
        this.deviceId = "";
        this.discovery = "";
        this.pusher = "";
        this.statusChecker = "";
        this._username = "";
        this._password = "";
        this._UID = "";
        //this.run();
    }

    // API call to the database to pull down any status updates. Should fire on ping from Pusher
    getUpdate() {
        return axios
            .get(`https://nameless-reef-34646.herokuapp.com/api/getUpdate/${this._UID}`)
            .then(data =>{
                console.log(data);
                console.log(data.piDevice.arduinos);
                // TODO: Check the deviceId: if not set, set it, if set, make sure it is correct
                // TODO:  Have it set the schedule and plantName for the one with the associated serial number
        })
            .catch(err => {if(err) console.log(err)})
    }

    // Loop over all the arduinos and have them return their status with the serial number associated
    getAllStatus() {
        if (this.arduinos.length) {
            let data = {};
            this.arduinos.forEach(arduino => {
                arduino.getAllStatusAndData();
                data[arduino.serialNumber] = arduino.data;
            });
            return data;
        } else {
            return "No devices present"
        }
    }

    // Posts an update to the API and triggers an update event
    updateApi() {
        let data = {id: this._UID, arduinos:[], status: this.status};
        // This parses through the arduino object and only keeps the data that we store on the server
        if(this.arduinos.length){
            this.arduinos.forEach(arduino =>{
                data.arduinos.push({
                    comName: arduino.comName ? arduino.comName : null,
                    serialNumber: arduino.serialNumber ? arduino.serialNumber : null,
                    deviceId: arduino.deviceId ? arduino.deviceId : null,
                    schedule: arduino.schedule ? arduino.schedule : null,
                    plantName: arduino.plantName ? arduino.plantName : null,
                    status: arduino.status ? arduino.status : null,
                    data: arduino.data ? arduino.data : null
                })
            })
        }
        axios
            .post(`https://nameless-reef-34646.herokuapp.com/api/updateArduino/`, data)
            .then(() => this.pusher.trigger() ) // Triggers an update event on the listener
            .catch(err => {if(err) console.log(err)})
    }

    // Searches for any devices plugged in that are made by arduino, then registers them if they have not been previously registered
    // or re-registers them to the appropriate comName
    async discover() {
        // Stores all ports that are available
        let ports = await SerialPort.list();
        ports.forEach(async port => {
            // Checks to see if the port has a manufacturer and if that manufacturer includes arduino
            if (port.manufacturer && port.manufacturer.split(" ").includes("Arduino")) {
                // Checks to see if the arduino is already in the array of arduinos
                if (!this.arduinos || !this.arduinos.some(arduino => arduino.serialNumber === port.serialNumber)) {

                    let newArd = new Arduino(port.comName, port.serialNumber);
                    // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity and set discover to false
                    let setup = await newArd.setup();
                    if (setup === "timeout") {
                        this.discovery = false;
                        return;
                    }
                    // Set the deviceId of the new arduino
                    if (this.arduinos.length) {
                        newArd.deviceId = this.arduinos[this.arduinos.length - 1].deviceId + 1;
                    } else {
                        newArd.deviceId = 1;
                    }
                    newArd.setDeviceId();
                    // Add the arduinos to the local set of devices
                    this.arduinos.push(newArd);
                    this.updateApi();
                }
                // If the serial number  has been registered to a different comPort in the past, reassign it to the new one
                // With the same schedule and id that it previously had
                else if (this.arduinos && this.arduinos.some(arduino => (arduino.serialNumber === port.serialNumber && arduino.comName !== port.comName))) {
                    for (let i = 0; i < this.arduinos.length; i++) {
                        if (this.arduinos[i].serialNumber === port.serialNumber) {
                            let newArd = new Arduino(port.comName, port.serialNumber);
                            // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity and set discover to false
                            let setup = await newArd.setup();
                            if (setup === "timeout") {
                                this.discovery = false;
                                return;
                            }
                            newArd.deviceId = this.arduinos[i].deviceId;
                            newArd.plantName = this.arduinos[i].plantName;
                            newArd.schedule = this.arduinos[i].schedule;
                            newArd.status = 0;
                            this.arduinos[i] = newArd;
                        }
                    }
                }
            }

        });
    }

    // Primary method that will keep the program running and acting properly
    async run() {
        await  this.setup();
        this.getUpdate();
        this.pusher = new Pusher(this._UID);
        this.pusher.subscribe(UID => {if(UID === this._UID) this.getUpdate()});
        this.discovery = setInterval(this.discover, 5000);
        this.statusChecker = setInterval(this.getAllStatus, 300000);
    }

    // Initial script that will have the user connect to wifi and log in to their account
    async setup() {
        wifi.init({iface: null});
        await this._setupWifi();
        await this._getCredentials();
        await this._authenticate();
    }

    async _setupWifi() {
        let ssid = await inquirer.prompt({
            name: "data",
            message: "Enter your wifi's name (SSID): ",
            validate: (data) => {
                if (data) return true
            }
        });
        let wifiPwd = await inquirer.prompt({
            name: "data",
            message: "Enter your wifi password: ",
            validate: (data) => {
                if (data) return true
            },
            type: "password"
        });

        let wifiLogin = {ssid: ssid.data, password: wifiPwd.data};

        return wifi.connect(wifiLogin, async err => {
            if (err) {
                console.log(err);
                return await this._setupWifi();
            }
            return 'Connected';
        });
    }

    async _getCredentials() {
        let username = await inquirer.prompt({
            name: "data",
            message: "Enter your account username: "

        });
        let password = await inquirer.prompt({
            name: "data",
            message: "Enter your account password: ",
            type: "password"
        });
        this._password = password.data;
        this._username = username.data;
    }

    _authenticate() {
        return axios
            .post("https://nameless-reef-34646.herokuapp.com/api/login", {username: this._username, password: this._password})
            .then(data => {
                this._UID = data.data.UID
            })
    }
}

module.exports = Pi;