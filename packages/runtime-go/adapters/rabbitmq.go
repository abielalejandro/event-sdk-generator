package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
	runtime "github.com/eventgen/runtime-go"
	"github.com/google/uuid"
)

type RabbitMQTransportAdapter struct {
	conn       *amqp.Connection
	ch         *amqp.Channel
	exchange   string
	routingKey string // if empty, uses envelope.EventID
}

func NewRabbitMQTransportAdapter(url, exchange, routingKey string) (*RabbitMQTransportAdapter, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq adapter: dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq adapter: channel: %w", err)
	}
	return &RabbitMQTransportAdapter{conn: conn, ch: ch, exchange: exchange, routingKey: routingKey}, nil
}

func NewRabbitMQTransportAdapterWithChannel(conn *amqp.Connection, ch *amqp.Channel, exchange, routingKey string) *RabbitMQTransportAdapter {
	return &RabbitMQTransportAdapter{conn: conn, ch: ch, exchange: exchange, routingKey: routingKey}
}

func (a *RabbitMQTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq adapter: marshal envelope: %w", err)
	}
	msgID := uuid.NewString()
	rk := a.routingKey
	if rk == "" {
		rk = envelope.EventID
	}
	err = a.ch.PublishWithContext(ctx, a.exchange, rk, false, false, amqp.Publishing{
		ContentType: "application/json",
		MessageId:   msgID,
		Body:        body,
		Headers: amqp.Table{
			"eventId": envelope.EventID,
			"version": envelope.Version,
			"traceId": envelope.Metadata.TraceID,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("rabbitmq adapter: publish %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: msgID}, nil
}

func (a *RabbitMQTransportAdapter) Close() error {
	if err := a.ch.Close(); err != nil {
		return err
	}
	return a.conn.Close()
}
