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
        // The interceptor adds the user to the header object in the request if authentication has occurred properly
        this.interceptor = axios.interceptors.request.use((config) => {
            if (this._UID) {
                config.headers = {user: this._UID};
            }
            return config;
        }, (error) => {
            return error;
        });
    }

    // API call to the database to pull down any status updates. Should fire on ping from Pusher
    getUpdate() {
        return axios
            .get(`https://nameless-reef-34646.herokuapp.com/api/arduinos`)
            .then(data => {
                log(data.data);
                let pi = data.data.piDevice;
                if (!this.deviceId) {
                    this.deviceId = pi.deviceId;
                    this.arduinos = pi.arduinos.map(arduino => {
                        let newArd = new Arduino(arduino.comName, arduino.serialNumber, arduino.deviceId, arduino.schedule, arduino.plantName, arduino.active);
                        newArd.setup();
                        newArd.setWateringSchedule();
                        newArd.reportSensors();
                        return newArd
                    });
                } else if (this.deviceId === pi.deviceId) {
                    if (this.arduinos) {
                        this.arduinos.forEach(arduino => {
                            arduino.clearWateringSchedule();
                            arduino.serialPort.close()
                        });
                    }
                    this.arduinos = pi.arduinos.map(arduino => {
                        log(arduino.active);
                        let newArd = new Arduino(arduino.comName, arduino.serialNumber, arduino.deviceId, arduino.schedule, arduino.plantName, arduino.active);
                        newArd.setup();
                        newArd.setWateringSchedule();
                        newArd.reportSensors();
                        return newArd
                    });
                    log(this.arduinos);
                }
            }).catch(err => {
                if (err) console.log(err)
            })
    }

    // Loop over all the arduinos and have them return their status with the serial number associated
    reportSensors() {
        if (this.arduinos.length) {
            let data = {};
            this.arduinos.forEach(arduino => {
                if (arduino.active) {
                    arduino.reportSensors();
                    data[arduino.serialNumber] = arduino.data;
                }
            });
            return data;
        } else {
            return "No devices present"
        }
    }

    // Posts an update to the API and triggers an update event
    updateApi() {
        let data = {arduinos: [], status: this.status};
        // This parses through the arduino object and only keeps the data that we store on the server
        if (this.arduinos) {
            this.arduinos.forEach(arduino => {
                data.arduinos.push({
                    comName: arduino.comName ? arduino.comName : null,
                    serialNumber: arduino.serialNumber ? arduino.serialNumber : null,
                    deviceId: arduino.deviceId ? arduino.deviceId : null,
                    schedule: arduino.schedule ? arduino.schedule : null,
                    plantName: arduino.plantName ? arduino.plantName : null,
                    status: arduino.status ? arduino.status : null,
                    data: arduino.data ? arduino.data : null,
                    active: arduino.active ? arduino.active : false
                })
            })
        }
        return axios
            .post(`https://nameless-reef-34646.herokuapp.com/api/updateArduinos/`, data)
            .then() // Triggers an update event on the listener
            .catch(err => {
                if (err) console.log(err)
            })
    }

    // Searches for any devices plugged in that are made by arduino, then registers them if they have not been previously registered
    // or re-registers them to the appropriate comName
    async discover() {
        // Stores all ports that are available
        let ports = await SerialPort.list();
        let serials = [];
        ports.forEach(async port => {
            // Checks to see if the port has a manufacturer and if that manufacturer includes arduino
            if (port.manufacturer && port.manufacturer.split(" ").includes("Arduino")) {
                // Add the serial number to the list of serials
                serials.push(port.serialNumber);
                // Checks to see if the arduino isn't  in the array of arduinos
                if (!this.arduinos || !this.arduinos.some(arduino => arduino.serialNumber === port.serialNumber)) {

                    let newArd = new Arduino(port.comName, port.serialNumber);
                    // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity and set discover to false
                    let setup = await newArd.setup();
                    if (setup === "timeout") {
                        return;
                    }
                    // Set the deviceId of the new arduino
                    if (this.arduinos.length) {
                        newArd.setDeviceId(parseInt(this.arduinos[this.arduinos.length - 1].deviceId) + 1);
                    } else {
                        newArd.setDeviceId(1);
                    }
                    // Add the arduinos to the local set of devices
                    this.arduinos.push(newArd);
                    this.updateApi();
                }
                // If the serial number  has been registered to a different comPort in the past, reassign it to the new one
                // With the same schedule and id that it previously had
                else if (this.arduinos && this.arduinos.some(arduino => (arduino.serialNumber === port.serialNumber && arduino.comName !== port.comName))) {
                    for (let i = 0; i < this.arduinos.length; i++) {
                        if (this.arduinos[i].serialNumber === port.serialNumber) {
                            let newArd = new Arduino(port.comName, port.serialNumber, this.arduinos[i].deviceId, this.arduinos[i].schedule, this.arduinos[i].plantName, this.arduinos[i].active);
                            // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity and set discover to false
                            let setup = await newArd.setup();
                            if (setup === "timeout") {
                                return;
                            }
                            newArd.status = 0;
                            this.arduinos[i] = newArd;
                            this.updateApi();
                        }
                    }
                }
            }
        });
        // Check the array of arduinos. If for some reason there is a serial number that was previously registered but is no longer in
        // Our list of devices, change this.active to false
        let inactive = false;
        for (let i = 0; i < this.arduinos.length; i++) {
            if (!serials.includes(this.arduinos[i].serialNumber) && this.arduinos[i].active !== false) {
                this.arduinos[i].active = false;
                inactive = true;
            }
            if (serials.includes(this.arduinos[i].serialNumber) && this.arduinos[i].active === false) {
                this.arduinos[i].active = true;
                inactive = true;
            }
        }
        if (inactive) {
            this.updateApi();
        }
    }


    // Primary method that will keep the program running and acting properly
    async run() {
        await this.setup();
        await this.getUpdate();
        this.pusher = new Pusher(this._UID);
        this.pusher.subscribe(UID => {
            if (UID.id === this._UID) this.getUpdate()
        });
        const discover = this.discover.bind(this);
        this.discovery = setInterval(discover, 5000);
        this.statusChecker = setInterval(() => this.reportSensors(), 300000);
    }

    // Initial script that will have the user connect to wifi and log in to their account
    async setup() {
        wifi.init({iface: null});
        // await this._setupWifi(); TODO: Don't forget to turn this on for production
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
            .post("https://nameless-reef-34646.herokuapp.com/api/login", {
                username: this._username,
                password: this._password
            })
            .then(data => {
                this._UID = data.data.UID;
                return "Authenticated"
            })
            .catch(async () => {
                console.log("Incorrect credentials, please try again");
                await this._getCredentials();
                return await this._authenticate();
            })
    }
}

module.exports = Pi;