import {
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  Query,
  DocumentData,
  Firestore,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface FirestoreQueryConstraint {
  field: string;
  operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in';
  value: unknown;
}

export class FirestoreService {
  constructor(private firestore: Firestore | null) {}

  private validateFirestore() {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }
  }

  async setDocument<T extends DocumentData>(
    collectionName: string,
    docId: string,
    data: T,
    merge = false
  ): Promise<void> {
    this.validateFirestore();
    await setDoc(doc(this.firestore!, collectionName, docId), data, { merge });
  }

  async addDocument<T extends DocumentData>(
    collectionName: string,
    data: T
  ): Promise<string> {
    this.validateFirestore();
    const docRef = await addDoc(collection(this.firestore!, collectionName), data);
    return docRef.id;
  }

  async getDocument<T extends DocumentData>(
    collectionName: string,
    docId: string
  ): Promise<T | null> {
    this.validateFirestore();
    const docSnap = await getDoc(doc(this.firestore!, collectionName, docId));
    return docSnap.exists() ? (docSnap.data() as T) : null;
  }

  async updateDocument<T extends Partial<DocumentData>>(
    collectionName: string,
    docId: string,
    data: T
  ): Promise<void> {
    this.validateFirestore();
    await updateDoc(doc(this.firestore!, collectionName, docId), data);
  }

  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    this.validateFirestore();
    await deleteDoc(doc(this.firestore!, collectionName, docId));
  }

  async queryDocuments<T extends DocumentData>(
    collectionName: string,
    constraints: FirestoreQueryConstraint[] = []
  ): Promise<(T & { id: string })[]> {
    this.validateFirestore();

    let q: Query<DocumentData>;

    if (constraints.length === 0) {
      q = query(collection(this.firestore!, collectionName));
    } else {
      const whereConstraints = constraints.map((c) =>
        where(c.field, c.operator, c.value)
      );
      q = query(collection(this.firestore!, collectionName), ...whereConstraints);
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as T & { id: string }));
  }

  async queryByField<T extends DocumentData>(
    collectionName: string,
    fieldName: string,
    value: unknown
  ): Promise<(T & { id: string })[]> {
    return this.queryDocuments<T>(collectionName, [
      { field: fieldName, operator: '==', value },
    ]);
  }
}

// Export singleton instance
export const firestoreService = new FirestoreService(db);
