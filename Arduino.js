SerialPort = require("serialport");
Readline = require("@serialport/parser-readline");
log = require("con-logger")

class Arduino {
    /**
     * 
     * @param {String} comName Address of the comport the device is connected to
     * @param {String} serialNumber Unique serial number of the device that is created by the manufacturer
     */
    constructor(comName, serialNumber) {
        this.comName = comName;
        this.serialNumber = serialNumber;
        this.plantName = "";
        this.schedule = {};
        this.deviceId = "";
        this.serialPort;
        this.parser;
        this.status = 1;
    }

    // Method that returns the status of all connected devices and their data as an object
    getAllStatusAndData() { }

    // Method that gets the status and data of a specific connected device
    getStatusAndData(device) { }

    // Method to get the overall system status of the devices attached (returns 0 or 1)
    getStatus() { }

    // Method that takes in a response from the arduino and parses it appropriately
    handleResponse(response) { }

    // Method that sends command to the arduino to turn the pump on
    startWater() { }

    // Method that sends command to the arduino to turn the pump off
    stopWater() { }

    // Method that initializes the serialport and parser. Must be called to initialize setup async
    setup() {
        this.serialPort = new SerialPort(this.comName)
        this.parser = this.serialPort.pipe(new Readline())
        this.parser.on("data", this.handleResponse)

        return new Promise((resolve, reject) => {
            let parser = this.serialPort.pipe(new Readline())
            let ping = setInterval(() => this.serialPort.write("<status>"), 1000)

            parser.on("data", data => {
                let dataArr = data.split("~")
                if (dataArr[0] === "status") {
                    this.status = parseInt(dataArr[1])
                } else {
                    log(data)
                }
            })

            let check = setInterval(() => {
                if (this.status > 0) {
                    clearInterval(check);
                    clearInterval(ping);
                    resolve(0)
                }
            }, 500)

            setTimeout(() => reject("Timeout occurred"), 60000)
        })
    }
}

module.exports = Arduino