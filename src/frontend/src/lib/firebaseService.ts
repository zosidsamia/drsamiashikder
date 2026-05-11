import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Query,
  getDocs,
  Firestore,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type WhereConstraint = {
  field: string;
  operator: '==' | '<' | '>' | '<=' | '>=' | '!=' | 'in' | 'array-contains';
  value: unknown;
};

export class FirestoreService {
  constructor(private firestore: Firestore | null) {}

  /**
   * Add a new document with auto-generated ID
   */
  async addDocument<T extends DocumentData>(
    collectionName: string,
    data: T
  ): Promise<string> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    const ref = await addDoc(collection(this.firestore, collectionName), data);
    return ref.id;
  }

  /**
   * Set a document (create or overwrite)
   */
  async setDocument<T extends DocumentData>(
    collectionName: string,
    docId: string,
    data: T,
    merge = false
  ): Promise<void> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    await setDoc(
      doc(this.firestore, collectionName, docId),
      data,
      { merge }
    );
  }

  /**
   * Get a single document
   */
  async getDocument<T extends DocumentData>(
    collectionName: string,
    docId: string
  ): Promise<T | null> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    const snapshot = await getDoc(
      doc(this.firestore, collectionName, docId)
    );
    return snapshot.exists() ? (snapshot.data() as T) : null;
  }

  /**
   * Update specific fields in a document
   */
  async updateDocument<T extends DocumentData>(
    collectionName: string,
    docId: string,
    data: Partial<T>
  ): Promise<void> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    await updateDoc(doc(this.firestore, collectionName, docId), data as any);
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    await deleteDoc(doc(this.firestore, collectionName, docId));
  }

  /**
   * Query documents with constraints
   */
  async queryDocuments<T extends DocumentData>(
    collectionName: string,
    constraints: WhereConstraint[] = []
  ): Promise<(T & { id: string })[]> {
    if (!this.firestore) throw new Error('Firestore not initialized');
    
    let q: Query = collection(this.firestore, collectionName);
    
    if (constraints.length > 0) {
      const whereConstraints = constraints.map((c) =>
        where(c.field, c.operator as any, c.value)
      );
      q = query(collection(this.firestore, collectionName), ...whereConstraints);
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as T & { id: string }));
  }

  /**
   * Query documents by a single field
   */
  async queryByField<T extends DocumentData>(
    collectionName: string,
    field: string,
    value: unknown
  ): Promise<(T & { id: string })[]> {
    return this.queryDocuments<T>(collectionName, [
      { field, operator: '==', value },
    ]);
  }
}

export const firestoreService = new FirestoreService(db);
