import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firestoreService } from '@/lib/firebaseService';
import { where, orderBy, limit, QueryConstraint } from 'firebase/firestore';

/**
 * Hook for querying Firestore documents
 */
export const useFirestoreQuery = <T extends Record<string, any>>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [collectionName, JSON.stringify(constraints)],
    queryFn: async () => {
      return firestoreService.queryDocuments<T>(collectionName, constraints);
    },
    enabled,
  });
};

/**
 * Hook for querying by a single field
 */
export const useFirestoreQueryByField = <T extends Record<string, any>>(
  collectionName: string,
  fieldName: string,
  operator: any,
  value: any,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [collectionName, fieldName, operator, value],
    queryFn: async () => {
      return firestoreService.queryByField<T>(collectionName, fieldName, operator, value);
    },
    enabled: enabled && value !== undefined,
  });
};

/**
 * Hook for getting a single document
 */
export const useFirestoreDocument = <T extends Record<string, any>>(
  collectionName: string,
  documentId: string | null | undefined,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [collectionName, documentId],
    queryFn: async () => {
      if (!documentId) return null;
      return firestoreService.getDocument<T>(collectionName, documentId);
    },
    enabled: enabled && !!documentId,
  });
};

/**
 * Hook for adding a document
 */
export const useAddFirestoreDocument = <T extends Record<string, any>>(
  collectionName: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: T) => firestoreService.addDocument(collectionName, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
};

/**
 * Hook for updating a document
 */
export const useUpdateFirestoreDocument = <T extends Record<string, any>>(
  collectionName: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: Partial<T>;
    }) => firestoreService.updateDocument(collectionName, documentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
};

/**
 * Hook for deleting a document
 */
export const useDeleteFirestoreDocument = (collectionName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      firestoreService.deleteDocument(collectionName, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
};
