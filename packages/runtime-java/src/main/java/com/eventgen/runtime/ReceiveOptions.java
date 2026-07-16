package com.eventgen.runtime;

public record ReceiveOptions(int maxMessages) {
    public ReceiveOptions {
        if (maxMessages <= 0) maxMessages = 1;
    }
}
