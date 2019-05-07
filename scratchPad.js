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



async function test() {
    let Pi = require("./Pi");
    let pi = new Pi();
    await pi._getCredentials();
    await pi._authenticate();
    await pi.getUpdate();
}

test();