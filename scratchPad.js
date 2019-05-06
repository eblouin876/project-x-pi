// Class for Raspberry Pi
// Has arduinos{}
// Has getAllStatus()
// Has discover()
// Has run()

// Class for each arduino instance
// Has comName
// Has serialNumber
// Has plantName
// Has schedule
// Has getStatus()
// Has startWater()
// Has stopWater()

let Pi = require("./Pi")

let test = new Pi()
test.discover()