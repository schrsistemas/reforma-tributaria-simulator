export type MessageKind = 'COMMAND' | 'EVENT' | 'QUERY';

export interface MessageEnvelope<TType extends string, TPayload> {
  messageId: string;
  messageKind: MessageKind;
  messageType: TType;
  schemaVersion: string;
  occurredAt: string;
  source: string;
  tenantId: string;
  correlationId: string;
  idempotencyKey?: string;
  causationId?: string;
  payload: TPayload;
}

export interface MessageDelivery {
  attempt: number;
  firstReceivedAt: string;
  lastReceivedAt: string;
}

export interface MessageProcessingResult {
  accepted: boolean;
  duplicate: boolean;
  retryable: boolean;
  errorCode?: string;
}
