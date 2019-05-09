// Class for Raspberry Pi
// Has arduinos{}
// Has reportSensors()
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

//
async function test() {
    let Pi = require("./Pi");
    let pi = new Pi();
    await pi.run();
    pi.arduinos.push({
        comName: "/dev/ttyACM0",
        serialNumber: "12345abcde",
        deviceId: "0",
        schedule: [{amount: 2, day:"monday", time:"08:00"}],
        plantName: "Cactus",
        status: 3,
        data: {pump: 0, temperature: 20, humidity: 30},
        active: true
    });
    pi.arduinos.push({
        comName: "/dev/ttyACM1",
        serialNumber: "12345abcde",
        deviceId: "0",
        schedule: [{amount: 5, day:"wednesday", time:"14:00"}],
        plantName: "Ficus",
        status: 3,
        data: {pump: 0, temperature: 20, humidity: 30},
        active: true
    });
    await pi.updateApi();

}

test();


// const Arduino = require("./Arduino");
// let ard = new Arduino("a","b");
// ard.setWateringSchedule();