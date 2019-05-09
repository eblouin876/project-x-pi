const Pi = require("./Pi")

let device = new Pi();

async function start() {
    await device.run()
}
start()