#!/bin/bash

# Create an operator
echo "Creating operator Mario Rossi..."
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createOperator(name: \"Mario\", surname: \"Rossi\", email: \"mario.rossi@example.com\", operatorType: STANDARD, maxConcurrentAppointments: 1, color: \"#FF6B6B\") { id name surname email operatorType maxConcurrentAppointments color } }"}' \
  | jq .

echo ""
echo "Operator created successfully!"
echo "You can now access GraphQL Playground at http://localhost:3000/graphql"