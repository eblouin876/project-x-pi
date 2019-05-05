class Arduino {
    constructor(comName, serialNumber) {
        this.comName;
        this.serialNumber;
        this.plantName;
        this.schedule;
    }

    // Method that returns the status of all connected devices and their data as an object
    getAllStatusAndData() { }

    // Method that gets the status and data of a specific connected device
    getStatusAndData(device) { }

    // Method to get the overall system status of the devices attached
    getStatus() { }

    // Method that sets device id unique to the setup
    setDeviceId() { }

    // Method that takes in a response from the arduino and parses it appropriately
    handleResponse(response) { }

    // Method that sends command to the arduino to turn the pump on
    startWater() { }

    // Method that sends command to the arduino to turn the pump off
    stopWater() { }
}