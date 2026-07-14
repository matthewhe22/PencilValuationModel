import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultInputs,
  migrateInputs,
  runModel,
  type ModelResults,
  type ValuationInputs,
} from '@pencil/engine';
import { newId, storage, type ValuationSummary } from '../platform/storage';

interface StoreValue {
  inputs: ValuationInputs;
  results: ModelResults;
  docId: string;
  docName: string;
  library: ValuationSummary[];
  /** Replace inputs via an updater over an immutable copy */
  update(fn: (draft: ValuationInputs) => void): void;
  setDocName(name: string): void;
  newValuation(): void;
  openValuation(id: string): Promise<void>;
  deleteValuation(id: string): Promise<void>;
  importInputs(raw: unknown, name?: string): void;
}

const StoreContext = createContext<StoreValue | null>(null);

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<ValuationInputs>(() => defaultInputs());
  const [docId, setDocId] = useState<string>(() => newId());
  const [docName, setDocName] = useState<string>('New valuation');
  const [library, setLibrary] = useState<ValuationSummary[]>([]);
  const loadedRef = useRef(false);

  // Restore last document on start
  useEffect(() => {
    void (async () => {
      const list = await storage.list();
      setLibrary(list);
      if (list.length > 0) {
        const doc = await storage.load(list[0].id);
        if (doc) {
          setInputs(migrateInputs(doc.inputs));
          setDocId(doc.id);
          setDocName(doc.name);
        }
      }
      loadedRef.current = true;
    })();
  }, []);

  // Autosave (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      void storage
        .save({ id: docId, name: docName, updatedAt: new Date().toISOString(), inputs })
        .then(() => storage.list())
        .then(setLibrary);
    }, 400);
    return () => clearTimeout(t);
  }, [inputs, docId, docName]);

  const results = useMemo(() => runModel(inputs), [inputs]);

  const value: StoreValue = {
    inputs,
    results,
    docId,
    docName,
    library,
    update(fn) {
      setInputs((prev) => {
        const draft = clone(prev);
        fn(draft);
        return draft;
      });
    },
    setDocName,
    newValuation() {
      setInputs(defaultInputs());
      setDocId(newId());
      setDocName('New valuation');
    },
    async openValuation(id) {
      const doc = await storage.load(id);
      if (doc) {
        setInputs(migrateInputs(doc.inputs));
        setDocId(doc.id);
        setDocName(doc.name);
      }
    },
    async deleteValuation(id) {
      await storage.remove(id);
      setLibrary(await storage.list());
      if (id === docId) {
        setInputs(defaultInputs());
        setDocId(newId());
        setDocName('New valuation');
      }
    },
    importInputs(raw, name) {
      const migrated = migrateInputs(raw);
      setInputs(migrated);
      setDocId(newId());
      setDocName(name ?? 'Imported valuation');
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}
