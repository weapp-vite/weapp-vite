import { GraphQLClient, gql } from 'graphql-request'
import { apiBase } from './base'
import type { ConversationInsight } from './types'

const graphqlClient = new GraphQLClient(`${apiBase}/graphql`)

export async function loadConversationInsightWithGraphqlRequest() {
  const query = gql`
    query ConversationInsight {
      conversationInsight {
        summary {
          title
          description
          health
        }
        metrics {
          label
          value
          trend
        }
        threads {
          id
          name
          unread
          lastMessage
        }
        actions {
          title
          detail
        }
      }
    }
  `
  const response = await graphqlClient.request<{ conversationInsight: ConversationInsight }>(query)
  return response.conversationInsight
}
