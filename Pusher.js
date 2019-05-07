const Pusher = require('pusher');
const PusherClient = require('pusher-client');

class livePusher {
    constructor(UID) {
        this.pusher = new Pusher({
            appId: '775254',
            key: 'b48dc9f2091a8e7665e9',
            secret: '2c9bbd22117b146fe968',
            cluster: 'us3',
            encrypted: true
        });
        this.id = UID;
        this.channels = [];
    }

    /**
     * @description Triggers an event broadcast to notify that the api has been updated
     */
    trigger() {
        this.pusher.trigger('project-x', 'update', {
            id: this.UID
        });
    }

    /**
     * @description subscribes to the channel for updates and preforms the cb function on receipt of trigger
     * @param cb - Callback function to run when an update is triggered. Should one parameter which will be the UID where the event was triggered
     */
    subscribe(cb) {
        let pusher = new PusherClient('b48dc9f2091a8e7665e9', {
            cluster: 'us3',
            forceTLS: true
        });
        let channel = pusher.subscribe('project-x');
        channel.bind('update', cb);
        this.channels.push(channel);
    }
}

module.exports = livePusher;