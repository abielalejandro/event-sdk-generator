package com.eventgen.runtime;

import java.util.Map;

public interface ReceivedMessage {
    EventEnvelope envelope();
    Object raw();
    Map<String, Object> attributes();
    void ack() throws Exception;
    void retry(Exception error) throws Exception;
    void deadLetter(Exception error) throws Exception;
}
