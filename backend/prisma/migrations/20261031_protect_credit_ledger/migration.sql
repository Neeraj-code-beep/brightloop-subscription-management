-- Enforce Credit Ledger Immutability via PostgreSQL Trigger
-- Prevents DELETE operations on CreditTransaction
-- Prevents UPDATE of financial amounts, balanceAfter, customerId, type, currency, and createdAt

CREATE OR REPLACE FUNCTION prevent_credit_transaction_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'CreditTransaction ledger is append-only: DELETE is strictly prohibited';
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.amount IS DISTINCT FROM NEW.amount OR
            OLD.balanceAfter IS DISTINCT FROM NEW.balanceAfter OR
            OLD.customerId IS DISTINCT FROM NEW.customerId OR
            OLD.type IS DISTINCT FROM NEW.type OR
            OLD.currency IS DISTINCT FROM NEW.currency OR
            OLD.createdAt IS DISTINCT FROM NEW.createdAt OR
            OLD.id IS DISTINCT FROM NEW.id) THEN
            RAISE EXCEPTION 'CreditTransaction ledger is immutable: modification of financial amounts, balances, or core fields is strictly prohibited';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_credit_ledger ON "CreditTransaction";
CREATE TRIGGER trg_protect_credit_ledger
BEFORE UPDATE OR DELETE ON "CreditTransaction"
FOR EACH ROW
EXECUTE FUNCTION prevent_credit_transaction_mutation();

