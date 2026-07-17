package com.eventgen.runtime;

import java.util.List;

public interface MessageSource extends AutoCloseable {
    List<ReceivedMessage> receive(ReceiveOptions options) throws Exception;

    @Override
    default void close() throws Exception {}
}
