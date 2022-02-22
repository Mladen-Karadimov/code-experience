// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'ap-south-1'});

// Create DynamoDB document client
var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

'use strict';
console.log('Loading function');

//let doc = require('dynamodb-doc');
let dynamo = docClient;//new doc.DynamoDB();
let tableName = 'ses-bounce-mail-table';

exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    const message = JSON.parse(event.Records[0].Sns.Message);

    switch(message.notificationType) {
        case "Bounce":
            handleBounce(message);
            break;
        case "Complaint":
            handleComplaint(message);
            break;
        case "Delivery":
            handleDelivery(message);
            break;
        default:
            callback("Unknown notification type: " + message.notificationType);
    }
};

function handleBounce(message) {
    const messageId = message.mail.messageId;
    const addresses = message.bounce.bouncedRecipients.map(function(recipient){
        return recipient.emailAddress;
    });
    const bounceType = message.bounce.bounceType;

    console.log("Message " + messageId + " bounced when sending to " + addresses.join(", ") + ". Bounce type: " + bounceType);

    for (var i=0; i<addresses.length; i++){
        writeDDB(messageId, addresses[i], message, tableName, "disable");
    }
}

function handleComplaint(message) {
    const messageId = message.mail.messageId;
    const addresses = message.complaint.complainedRecipients.map(function(recipient){
        return recipient.emailAddress;
    });

    console.log("A complaint was reported by " + addresses.join(", ") + " for message " + messageId + ".");

    for (var i=0; i<addresses.length; i++){
        writeDDB(messageId, addresses[i], message, tableName, "disable");
    }
}

function handleDelivery(message) {
    const messageId = message.mail.messageId;
    const deliveryTimestamp = message.delivery.timestamp;
    const addresses = message.delivery.recipients;

    console.log("Message " + messageId + " was delivered successfully at " + deliveryTimestamp + ".");

    for (var i=0; i<addresses.length; i++){
        writeDDB(messageId, addresses[i], message, tableName, "enable");
    }
}

function writeDDB(messageId, id, payload, tableName, status) {
    const item = {
            MessageId: messageId,
            UserId: id,
            notificationType: payload.notificationType,
            from: payload.mail.source,
            timestamp: payload.mail.timestamp,
            state: status
        };
    const params = {
            TableName:tableName,
            Item: item
        };
    dynamo.put(params,function(err,data){
            if (err) console.log(err);
            else console.log(data);
    });
}