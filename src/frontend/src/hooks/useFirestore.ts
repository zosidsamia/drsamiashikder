import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firestoreService, WhereConstraint } from '@/lib/firebaseService';
import { DocumentData } from 'firebase/firestore';

/**
 * Query a collection
 */
export function useFirestoreQuery<T extends DocumentData>(
  collectionName: string
) {
  return useQuery({
    queryKey: [collectionName],
    queryFn: () => firestoreService.queryDocuments<T>(collectionName),
  });
}

/**
 * Query by field constraint
 */
export function useFirestoreQueryByField<T extends DocumentData>(
  collectionName: string,
  field: string,
  value: unknown
) {
  return useQuery({
    queryKey: [collectionName, field, value],
    queryFn: () =>
      firestoreService.queryByField<T>(collectionName, field, value),
  });
}

/**
 * Get a single document
 */
export function useFirestoreDocument<T extends DocumentData>(
  collectionName: string,
  docId: string | null
) {
  return useQuery({
    queryKey: [collectionName, docId],
    queryFn: () =>
      docId
        ? firestoreService.getDocument<T>(collectionName, docId)
        : Promise.resolve(null),
    enabled: !!docId,
  });
}

/**
 * Add document mutation
 */
export function useAddFirestoreDocument(collectionName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DocumentData) =>
      firestoreService.addDocument(collectionName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
}

/**
 * Update document mutation
 */
export function useUpdateFirestoreDocument(collectionName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ docId, data }: { docId: string; data: DocumentData }) =>
      firestoreService.updateDocument(collectionName, docId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
}

/**
 * Delete document mutation
 */
export function useDeleteFirestoreDocument(collectionName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: string) =>
      firestoreService.deleteDocument(collectionName, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
}
