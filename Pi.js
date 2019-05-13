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
        this.discovery; // Used to hold timers set by this.run()
        this.pusher = "";
        this.statusChecker; // Used to hold timers set by this.run()
        this._username = "";
        this._password = "";
        this._UID = "";
        // The interceptor adds the user to the header object in the request if authentication has occurred properly
        this.interceptor = axios.interceptors.request.use((config) => {
            if (this._UID) {
                config.headers = {user: this._UID};
            }
            return config;
        }, (error) => error)
    }

    // API call to the database to pull down any status updates. Should fire on ping from Pusher
    getUpdate() {
        return axios
            .get(`https://nameless-reef-34646.herokuapp.com/api/arduinos`)
            .then(data => {
                // log(data.data);
                let pi = data.data.piDevice;
                // Tun this block if the device ID hasn't been set yet (to associate it with the account)
                if (!this.deviceId) {
                    this.deviceId = pi.deviceId;
                    // Rebuild the array of arduinos present with what is pulled from the database
                    this.arduinos = pi.arduinos.map(arduino => {
                        let newArd = new Arduino(arduino.comName, arduino.serialNumber, arduino.deviceId, arduino.schedule, arduino.plantName, arduino.active);
                        newArd.setup();
                        // Only set a watering schedule and report the sensors if the arduino is flagged as active
                        if (arduino.active) {
                            newArd.setWateringSchedule();
                            newArd.reportSensors();
                        }
                        return newArd
                    });
                } else if (this.deviceId === pi.deviceId) {
                    // Clears the watering schedules set for the previous arduinos
                    if (this.arduinos) {
                        this.arduinos.forEach(arduino => {
                            arduino.clearWateringSchedule();
                            arduino.serialPort.close()
                        });
                    }
                    // Rebuild the array of arduinos present with what is pulled from the database
                    this.arduinos = pi.arduinos.map(arduino => {
                        let newArd = new Arduino(arduino.comName, arduino.serialNumber, arduino.deviceId, arduino.schedule, arduino.plantName, arduino.active);
                        newArd.setup();
                        // Only set a watering schedule and report the sensors if the arduino is flagged as active
                        if (arduino.active) {
                            newArd.setWateringSchedule();
                            newArd.reportSensors();
                        }
                        return newArd
                    });
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
                // Checks that the arduino is flagged active
                if (arduino.active) {
                    // Has the arduino ask its sensors for data (stored in arduino.data
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
        if (this.arduinos) {
            this.arduinos.forEach(arduino => {
                // Parses through the arduino object and only grabs the information that we will store in the database
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
        // A storage point for the serial numbers of the devices that are found in the forEach block to be accessed after
        let serials = [];
        ports.forEach(async port => {
            // Checks to see if the port has a manufacturer and if that manufacturer includes arduino
            if (port.manufacturer && port.manufacturer.split(" ").includes("Arduino")) {
                // Add the serial number to the list of serials
                serials.push(port.serialNumber);
                // Checks to see if the arduinos array is empty or if the arduino isn't in the array of arduinos already
                if (!this.arduinos || !this.arduinos.some(arduino => arduino.serialNumber === port.serialNumber)) {
                    let newArd = new Arduino(port.comName, port.serialNumber);
                    // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity
                    let setup = await newArd.setup();
                    // If setup fails, it breaks out of discovery here
                    if (setup === "timeout") {
                        return;
                    }
                    // Set the deviceId of the new arduino based on the device ids of the other arduinos present
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
                            // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity
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
        // Sets up the device properly and allows it to register before moving on
        await this.setup();
        // Gets an initial update from the database before moving on
        await this.getUpdate();
        // Sets up the listener for live updates to the database
        this.pusher = new Pusher(this._UID);
        this.pusher.subscribe(UID => {
            if (UID.id === this._UID) this.getUpdate()
        });
        // Binds this to the discover method and sets it to run every 5 seconds
        const discover = this.discover.bind(this);
        this.discovery = setInterval(discover, 5000);
        // Has the report sensors method run every 30 seconds - if there is an error, it should handle it.
        this.statusChecker = setInterval(() => this.reportSensors(), 300000); //TODO: This just returns data, doesn't yet do anything with it. Error handling should go here
    //    TODO: REMOVE AFTER TESTING
        setInterval(() => this.reportSensors(), 5000);
    }

    // Initial script that will have the user connect to wifi and log in to their account
    async setup() {
        // Sets up the wifi and allows us to connect to it from the command line
        wifi.init({iface: null});
        // await this._setupWifi(); TODO: Don't forget to turn this on for production
        // Gets and stores credentials for the user account (just in case it has to reauthenticate in the future)
        if (!this._username && !this._password) await this._getCredentials();
        // Authenticates the device to the appropriate account and adds the header that allows for persistent auth
        await this._authenticate();
    }

    // Method for loggin into the wifi
    async _setupWifi() {
        // Gets the name of the wifi to log in to
        let ssid = await inquirer.prompt({
            name: "data",
            message: "Enter your wifi's name (SSID): ",
            validate: (data) => {
                if (data) return true
            }
        });
        // Gets the password of the wifi to log  in to
        let wifiPwd = await inquirer.prompt({
            name: "data",
            message: "Enter your wifi password: ",
            validate: (data) => {
                if (data) return true
            },
            type: "password"
        });

        let wifiLogin = {ssid: ssid.data, password: wifiPwd.data};

        // Logs in to the wifi. If it is unsuccessful, it will retry to connect in a loop
        return wifi.connect(wifiLogin, async err => {
            if (err) {
                console.log(err);
                return await this._setupWifi();
            }
            return 'Connected';
        });
    }

    // Method to grab the username/password for the account
    async _getCredentials() {
        // Gets the username for the watering account
        let username = await inquirer.prompt({
            name: "data",
            message: "Enter your account username: "

        });
        // Gets the password for the watering account
        let password = await inquirer.prompt({
            name: "data",
            message: "Enter your account password: ",
            type: "password"
        });
        // Stores as (semi)private variables in the pi object
        this._password = password.data;
        this._username = username.data;
    }

    // Method to hit the API and properly authenticate the account
    _authenticate() {
        return axios
            .post("https://nameless-reef-34646.herokuapp.com/api/login", {
                username: this._username,
                password: this._password
            })
            // When this runs successfully, it sets this._UID to the returned UID, which will be used for persistent auth
            .then(data => {
                this._UID = data.data.UID;
                return "Authenticated"
            })
            // If it is rejected, it runs in a loop until it successfully logs in, showing an Incorrect credentials message
            .catch(async () => {
                console.log("Incorrect credentials, please try again");
                await this._getCredentials();
                return await this._authenticate();
            })
    }
}

module.exports = Pi;