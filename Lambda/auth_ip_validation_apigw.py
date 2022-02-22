VALID_IPS = ["1.2.3.4"]

def lambda_handler(event, context):

    #clientIp = event['headers']['X-Forwarded-For']
    clientIp = event["requestContext"]["http"]["sourceIp"]

    # Verify that the client IP address is allowed.
    # If it’s not valid, raise an exception to make sure
    # that API Gateway returns a 401 status code.
    if clientIp not in VALID_IPS:
        raise Exception('Unauthorized')

    return {"isAuthorized": True }
