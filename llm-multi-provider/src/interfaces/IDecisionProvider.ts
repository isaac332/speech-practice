import type { DecisionRequest, DecisionResponse } from "../types/DecisionTypes";

export interface IDecisionProvider {
  readonly id: string;
  readonly providerName: string;
  evaluate(request: DecisionRequest): Promise<DecisionResponse>;
  validateConfig(): boolean;
}