import pgpubsub, os, logging, json, time, sys
from utils.kafka_handler import KafkaHandler
from utils.kafka_handler import KafkaRequestPermissionUpdate

PUBSUB_CHANNEL_NAME = 'network_element_update'
KAFKA_PERM_UPDATE_TOPIC = 'permission-update'
KAFKA_SERVICE_LOGS_TOPIC = 'service-logs'

DB_USER = os.environ.get('dbUser','pr1')
DB_PASS = os.environ.get('dbPass','pr1')
DB_HOST = os.environ.get('dbHost','192.168.16.57')
DB_PORT = os.environ.get('dbPort','5432')
DB_NAME = os.environ.get('dbName', 'pr1')

KAFKA_SERVERS = os.environ.get('kafkaBootstrapServers', '192.168.16.38:9092')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%Y-%m-%d %T:%M:%S')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

kh = KafkaHandler([KAFKA_SERVERS], KAFKA_SERVICE_LOGS_TOPIC, tls=None)
logger.addHandler(kh)

#init kafka audit-logs
kafka_pusher = KafkaRequestPermissionUpdate(KAFKA_SERVERS, KAFKA_PERM_UPDATE_TOPIC, tls=None)

logging.info('Trying to connect to db ' + DB_NAME + '...')
try:
    pubsub = pgpubsub.connect(user=DB_USER, password=DB_PASS, database=DB_NAME, host=DB_HOST, port=DB_PORT)
    logging.info('Connected!')
except Exception as e:
    logging.exception(e)
    logging.critical('Can\'t connect to database, exiting...')
    sys.exit(1)

logging.info('Start listening on channel ' + PUBSUB_CHANNEL_NAME + '...')
pubsub.listen(PUBSUB_CHANNEL_NAME)
logging.info('Listening started!')

logging.info('Receiving events...')
#for e in pubsub.events():
#    try:
#        evt = json.loads(e.payload)
#    except:
#        logging.warning('Error while trying to parse json')
#        continue

#    logging.info('Pushing event {} to kafka topic {}'.format(evt, PUBSUB_CHANNEL_NAME))
#    kafka_pusher.push(evt)
#    logging.info('Event sent successfully!')


while(True):
    logging.info('Trying to obtain a pg event...')
    e = pubsub.get_event()
    if e is None:
        logging.info('No pg event found, will try again after 30s.')
        time.sleep(30)
        continue

    logging.info('Pg event caught, handling....')
    try:
        evt = json.loads(e.payload)
    except:
        logging.warning('Error while trying to parse json')
        continue

    logging.info('Pushing event {} to kafka topic {}'.format(evt, PUBSUB_CHANNEL_NAME))
    kafka_pusher.push(evt)
    logging.info('Event sent successfully!')	

    print("This was a great DEMO!")
