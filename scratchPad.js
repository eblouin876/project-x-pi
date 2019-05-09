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
        comName: "A test",
        serialNumber: "Emile's Account again",
        deviceId: "0",
        schedule: [{amount: 2, day:"monday", time:"08:00"}],
        plantName: "Cactus",
        status: 3,
        data: {pump: 0, temperature: 20, humidity: 30}
    });
    pi.arduinos.push({
        comName: "A test",
        serialNumber: "Emile's Account again",
        deviceId: "3",
        schedule: [{amount: 2, day:"thursday", time:"16:00"}],
        plantName: "Ficus",
        status: 3,
        data: {pump: 0, temperature: 20, humidity: 30}
    });
    await pi.updateApi();

}

test();


// const Arduino = require("./Arduino");
// let ard = new Arduino("a","b");
// ard.setWateringSchedule();