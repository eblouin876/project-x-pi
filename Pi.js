log = require("con-logger");
Arduino = require("./Arduino");

class Pi {

    constructor() {
        this.arduinos = [];
        this.status;
        this.serialNumber;
        this.discover = false; // This is set to true when it receives an update from the API
        this.username;
        this.password; // TODO: Make sure that this is hashed
        this.setup();
        this.run();
    }

    // API call to the database to pull down any status updates. Should fire on ping from Pusher
    getUpdate() { }

    // Loop over all the arduinos and have them return their status with the serial number associated
    getAllStatus() {
        if (this.arduinos.length) {
            let data = {};
            this.arduinos.forEach(arduino => {
                let stats = arduino.getAllStatus();
                data[arduino.serialNumber] = stats;
            })
            return data;
        } else {
            return "No devices present"
        }
    }

    // Push the pi into a mode where it looks for a new arduino plugged in, checks to make sure it isn't already registered,
    //  then registers it to the database 
    async discover() {
        // Allows discovery to run only when this.discover is true
        while (this.discover) {
            // Stores all ports that are available
            let ports = await SerialPort.list();
            ports.forEach(async port => {
                // Checks to see if the port has a manufacturer and if that manufacturer includes arduino
                if (port.manufacturer && port.manufacturer.split(" ").includes("Arduino")) {
                    // TODO: Add functionality to check and see if the id has been locally registered on a different port then change the port to match

                    // Checks to see if the arduino is already in the array of arduinos
                    if (!this.arduinos || !this.arduinos.some(arduino => arduino.serialNumber === port.serialNumber)) {

                        let newArd = new Arduino(port.comName, port.serialNumber);

                        // Setup is called seperately so that we can await properly. It will break after 60 seconds of inactivity and set discover to false
                        let setup = await newArd.setup();
                        if (setup === "timeout") {
                            this.discover = false;
                            return;
                        }

                        // Set the deviceId of the new arduino
                        if (this.arduinos.length) {
                            newArd.deviceId = this.arduinos[this.arduinos.length - 1].deviceId + 1;
                        } else {
                            newArd.deviceId = 0;
                        }
                        // Add the arduinos to the local set of devices
                        this.arduinos.push(newArd);

                        // TODO: Push the new device up to the database and set discover to false both locally and on the api
                        log(newArd);

                        return
                    }
                }
            })
        }
    }

    // Primary method that will keep the program running and acting properly while it is on the pi
    // will respond to pusher to call this.getSchedule() and this.discover()
    run() { }

    // Initial script that will have the user connect to wifi or plug in ethernet and put in their username/password
    // generated on the app. It will then log in and trigger the API to update to connected and set the status
    // to 0 when the setup has completed correctly
    setup() { }

}

module.exports = Pi