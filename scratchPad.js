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
    let schedule = [];
    for (let i = 0; i < 30; i++) {
        let amount = .25;
        let day = "monday";
        let minutes = i * 2;
        if (minutes < 10) minutes = "0" + minutes;
        let time = `10:${minutes}`;
        schedule.push({amount, day, time})
    }
    pi.arduinos.push({
        comName: "/dev/ttyACM0",
        serialNumber: "758303331393511082E0",
        deviceId: "1",
        schedule: schedule,
        plantName: "Demo Ficus",
        status: "0",
        data: {},
        active: false
    });
    await pi.updateApi();
}

test();


// const Arduino = require("./Arduino");
// let ard = new Arduino("a","b");
// ard.setWateringSchedule();