import axios from 'axios';
import { AppError, ValidationError } from '../middleware/errorHandler';

export interface JiraIssue {
  key: string;
  title: string;
  body: string;
  htmlUrl: string;
}

export const parseJiraSite = (baseUrl?: string | null): string | null => {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (!url.hostname.includes('atlassian.net') && !url.hostname.includes('jira')) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
};

export class JiraService {
  async listOpenIssues(input: {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
    limit?: number;
  }): Promise<JiraIssue[]> {
    const site = parseJiraSite(input.baseUrl);
    if (!site) throw new ValidationError('Project Jira URL is not a valid Jira Cloud site');
    if (!input.apiToken) throw new AppError('Jira API token is required', 422);
    const { data } = await axios.get(`${site}/rest/api/3/search`, {
      params: {
        jql: `project=${input.projectKey} AND statusCategory != Done ORDER BY created DESC`,
        maxResults: input.limit || 20,
        fields: 'summary,description,status',
      },
      auth: { username: input.email, password: input.apiToken },
      timeout: 20000,
    });
    return (data.issues || []).map((issue: any) => ({
      key: issue.key,
      title: issue.fields?.summary || issue.key,
      body: typeof issue.fields?.description === 'string'
        ? issue.fields.description
        : JSON.stringify(issue.fields?.description || ''),
      htmlUrl: `${site}/browse/${issue.key}`,
    }));
  }
}

export default new JiraService();
