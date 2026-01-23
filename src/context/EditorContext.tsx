import React, { createContext, useContext, useState, useMemo } from 'react';

export type EditorTool =
  | 'trim'
  | 'crop'
  | 'bgm'
  | 'text'
  | 'voiceover'
  | 'mutation'
  | 'save';

export type SelectedTool = EditorTool | null;

type EditorContextValue = {
  activeTool: SelectedTool;
  setActiveTool: (tool: SelectedTool) => void;
  enabledTools: Record<EditorTool, boolean>;
  isEditorReady: boolean;
  markEditorReady: () => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

type EditorProviderProps = {
  children: React.ReactNode;
  enabledFeatures: {
    editTrim: boolean;
    editCrop: boolean;
    editBGM: boolean;
    editTextOverlay: boolean;
    editVoiceOver: boolean;
  };
};

export const EditorProvider: React.FC<EditorProviderProps> = ({
  children,
  enabledFeatures,
}) => {
  const [activeTool, setActiveTool] = useState<SelectedTool>(null);
  const [isEditorReady, setEditorReady] = useState(false);

  const enabledTools = useMemo<Record<EditorTool, boolean>>(
    () => ({
      trim: enabledFeatures.editTrim,
      crop: enabledFeatures.editCrop,
      bgm: enabledFeatures.editBGM,
      text: enabledFeatures.editTextOverlay,
      voiceover: enabledFeatures.editVoiceOver,
      mutation: true,
      save: true,
      null: false,
    }),
    [enabledFeatures]
  );

  const markEditorReady = () => setEditorReady(true);

  return (
    <EditorContext.Provider
      value={{
        activeTool: activeTool as EditorTool,
        setActiveTool,
        enabledTools,
        isEditorReady,
        markEditorReady,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditorContext must be used inside EditorProvider');
  }
  return ctx;
};
