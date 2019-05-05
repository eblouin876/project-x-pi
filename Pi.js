class Pi {
    constructor() {
        this.schedule;
        this.arduinos;
        this.status;
        this.serialNumber;
        this.username;
        this.password; // TODO: Make sure that this is hashed
        this.setup();
    }

    // API call to the database to pull down any status updates. Should fire on ping from Pusher
    getSchedule() { }

    // Loop over all the arduinos and have them return their status with the serial number associated
    getAllStatus() { }

    // Push the pi into a mode where it looks for a new arduino plugged in then registers it to the database
    discover() { }

    // Primary method that will keep the program running and acting properly while it is on the pi
    // will respond to pusher to call this.getSchedule() and this.discover()
    run() { }

    // Initial script that will have the user connect to wifi or plug in ethernet and put in their username/password
    // generated on the app. It will then log in and trigger the API to update to connected and set the status
    // to 0 when the setup has completed correctly
    setup() { }

}