import { ref, uploadBytes, downloadUrl, getBytes } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Firebase Storage service for file operations
 */
export class FirebaseStorageService {
  private storageInstance = storage;

  private ensureStorage() {
    if (!this.storageInstance) {
      throw new Error('Firebase Storage is not initialized. Check Firebase configuration.');
    }
  }

  /**
   * Upload a file to Firebase Storage
   */
  async uploadFile(filePath: string, file: File | Blob): Promise<string> {
    this.ensureStorage();
    const fileRef = ref(this.storageInstance!, filePath);
    const snapshot = await uploadBytes(fileRef, file);
    return snapshot.ref.fullPath;
  }

  /**
   * Delete a file from Firebase Storage
   */
  async deleteFile(filePath: string): Promise<void> {
    this.ensureStorage();
    const fileRef = ref(this.storageInstance!, filePath);
    // Note: deleteObject requires importing from firebase/storage
    const { deleteObject } = await import('firebase/storage');
    await deleteObject(fileRef);
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(filePath: string): Promise<string> {
    this.ensureStorage();
    const fileRef = ref(this.storageInstance!, filePath);
    const { getDownloadURL } = await import('firebase/storage');
    return getDownloadURL(fileRef);
  }

  /**
   * Download file as Blob
   */
  async downloadFile(filePath: string): Promise<Blob> {
    this.ensureStorage();
    const fileRef = ref(this.storageInstance!, filePath);
    const bytes = await getBytes(fileRef);
    return new Blob([bytes]);
  }
}

export const firebaseStorageService = new FirebaseStorageService();
