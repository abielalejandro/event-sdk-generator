package com.eventgen.runtime;

/**
 * FIFO options for ordered delivery in SQS FIFO queues and SNS FIFO topics.
 */
public record FifoOptions(
    /** Groups messages for ordered delivery. Required for FIFO. */
    String messageGroupId,
    /**
     * Unique deduplication token (5-minute window).
     * If null, content-based deduplication must be enabled on the queue/topic.
     */
    String deduplicationId
) {
    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String messageGroupId;
        private String deduplicationId;

        public Builder messageGroupId(String messageGroupId) { this.messageGroupId = messageGroupId; return this; }
        public Builder deduplicationId(String deduplicationId) { this.deduplicationId = deduplicationId; return this; }

        public FifoOptions build() {
            if (messageGroupId == null || messageGroupId.isBlank())
                throw new IllegalArgumentException("messageGroupId is required for FIFO");
            return new FifoOptions(messageGroupId, deduplicationId);
        }
    }
}
