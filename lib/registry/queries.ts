// GraphQL query matching exact entity fields from Subgraph schema documentation
export const AGENTS_QUERY = `
  query GetAgents($first: Int!, $skip: Int!) {
    agents(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      chainId
      agentId
      owner
      createdAt
      totalFeedback
      registrationFile {
        name
        description
        image
        mcpEndpoint
        mcpTools
        a2aEndpoint
        a2aSkills
        supportedTrusts
        x402Support
        ens
        did
      }
      feedback(where: { isRevoked: false }, first: 5, orderBy: createdAt, orderDirection: desc) {
        tag1
        tag2
        clientAddress
        feedbackFile {
          text
        }
      }
      validations(orderBy: createdAt, orderDirection: desc) {
        validatorAddress
        response
        status
        tag
      }
    }
  }
`;
