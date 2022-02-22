# -*- coding: utf-8 -*-
"""Module to provide kafka handlers for internal logging facility."""

import json
import logging
import time
import sys

from kafka import KafkaProducer
from kafka.errors import KafkaError

class KafkaHandler(logging.Handler):
    """Class to instantiate the kafka logging facility."""

    def __init__(self, hostlist, topic='service-logs', tls=None, containerName='pg-listener'):
        """Initialize an instance of the kafka handler."""
        logging.Handler.__init__(self)
        self.producer = KafkaProducer(bootstrap_servers=hostlist,
                                      value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                                      linger_ms=10)
        self.topic = topic
        self.containerName = containerName

    def emit(self, record):
        """Emit the provided record to the kafka_client producer."""
        # drop kafka logging to avoid infinite recursion
        if 'kafka.' in record.name:
            return

        try:
            # apply the logger formatter
            msg = self.format(record)
            split_time = record.asctime.split(':')
            #time = split_time[0] + ':' + split_time[1] + ':' + split_time[2] + ':' + split_time[3]
            self.producer.send(self.topic, {'message': self.containerName + ' - ' + record.levelname + ' - ' + msg, 'serviceName': 'pg-listener', 'dockerId': self.containerName, 'level': record.levelname} )
            self.flush(timeout=1.0)
        except Exception:
            logging.Handler.handleError(self, record)

    def flush(self, timeout=None):
        """Flush the objects."""
        self.producer.flush(timeout=timeout)

    def close(self):
        """Close the producer and clean up."""
        self.acquire()
        try:
            if self.producer:
                self.producer.close()

            logging.Handler.close(self)
        finally:
            self.release()

class KafkaRequestPermissionUpdate():
    def __init__(self, hostlist, topic='permission-update', tls=None):
        self.producer = KafkaProducer(bootstrap_servers=hostlist,
                                      value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                                      linger_ms=10)
        self.topic = topic

    def push(self, event):
        logging.info('For {}: "{}".'.format(self.topic, event))
        try:
            self.producer.send(self.topic, event)
            self.flush(timeout=1.0)
        except KafkaError:
            logging.exception()

    def flush(self, timeout=None):
        """Flush the objects."""
        self.producer.flush(timeout=timeout)

    def close(self):
        """Close the producer and clean up."""
        self.acquire()
        try:
            if self.producer:
                self.producer.close()
            logging.info('Kafka connection closed!')
        finally:
            self.release()