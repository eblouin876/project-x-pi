const SerialPort = require("serialport")
const Readline = require("@serialport/parser-readline")
const log = require("con-logger")

async function setupPorts() {
    let ports = await SerialPort.list()
    ports.forEach(port => {
        if (port.manufacturer && port.manufacturer.split(" ").includes("Arduino")) {

            log(port.comName)
            log(port.serialNumber)

            const serialPort = new SerialPort(port.comName)
            const parser = serialPort.pipe(new Readline())

            let status = 1

            parser.on("data", data => {
                dataArr = data.split("~")
                if (dataArr[0] === "status") {
                    status = parseInt(dataArr[1])
                } else {
                    log(data)
                }
            })

            var ping = setInterval(() => serialPort.write("<status>"), 1000)

            var command = setInterval(() => { if (status <= 0) serialPort.write("<Command>") }, 500)

            // if (status <= 0) {
            //     // serialPort.on("open", function () {
            //     //     parser.on("data", data => {
            //     //         if (data === "Ready") {
            //     serialPort.write("Command") // May not be received until arduino is ready
            //     // }
            //     // })
            //     // })
            // }
        }
    })
}

setupPorts()

// sudo chmod a+rw /dev/ttyACM0 Necessary on the vm to give write permissions
