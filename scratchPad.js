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
    await pi.run();
    pi.arduinos.push({
        comName: "1",
        serialNumber: "2",
        deviceId: "3",
        schedule: [{duration: 1, days: [{day: "monday", time: 5}]}],
        plantName: "5",
        status: 0,
        data: {pump: 0, temperature: 20, humidity: 30}
    });
    await pi.updateApi();
    // await pi.getUpdate();
}

test();