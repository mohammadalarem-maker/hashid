import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Simple in-memory cache for the Google Workspace Access Token
let workspaceAccessToken: string | null = null;
let workspaceUserEmail: string | null = null;

export const getWorkspaceToken = (): string | null => {
  return workspaceAccessToken;
};

export const setWorkspaceToken = (token: string | null, email?: string | null) => {
  workspaceAccessToken = token;
  if (email !== undefined) {
    workspaceUserEmail = email;
  }
};

export const getWorkspaceUserEmail = (): string | null => {
  return workspaceUserEmail;
};

/**
 * Triggers the Google Auth popup with Gmail scopes to fetch a fresh token.
 */
export const connectGmailAccount = async (): Promise<{ accessToken: string; email: string } | null> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.addScope('https://www.googleapis.com/auth/gmail.modify');

    // Forces account selection and consent if required
    provider.setCustomParameters({
      prompt: 'consent select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve OAuth access token from Google');
    }

    workspaceAccessToken = credential.accessToken;
    workspaceUserEmail = result.user.email;

    return {
      accessToken: workspaceAccessToken,
      email: workspaceUserEmail || ''
    };
  } catch (error: any) {
    console.error('Error connecting to Workspace / Gmail:', error);
    throw error;
  }
};

export const disconnectGmailAccount = () => {
  workspaceAccessToken = null;
  workspaceUserEmail = null;
};
