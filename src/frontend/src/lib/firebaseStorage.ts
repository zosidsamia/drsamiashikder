import {
  ref,
  uploadBytes,
  deleteObject,
  getBytes,
  getDownloadURL,
  Storage,
} from 'firebase/storage';
import { storage } from '@/lib/firebase';

export class FirebaseStorageService {
  constructor(private storageRef: Storage | null) {}

  /**
   * Upload a file to storage
   */
  async uploadFile(path: string, file: File | Blob): Promise<string> {
    if (!this.storageRef) throw new Error('Storage not initialized');
    const fileRef = ref(this.storageRef, path);
    await uploadBytes(fileRef, file);
    return this.getDownloadUrl(path);
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(path: string): Promise<string> {
    if (!this.storageRef) throw new Error('Storage not initialized');
    return getDownloadURL(ref(this.storageRef, path));
  }

  /**
   * Download file as Blob
   */
  async downloadFile(path: string): Promise<Blob> {
    if (!this.storageRef) throw new Error('Storage not initialized');
    const fileRef = ref(this.storageRef, path);
    const bytes = await getBytes(fileRef);
    return new Blob([bytes]);
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.storageRef) throw new Error('Storage not initialized');
    await deleteObject(ref(this.storageRef, path));
  }
}

export const firebaseStorageService = new FirebaseStorageService(storage);
