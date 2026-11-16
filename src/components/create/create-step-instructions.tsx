export function CreateStepInstructions({ instructions }: { instructions: readonly string[] }) {
  return (
    <div className="create-step-instructions">
      <h3>따라 하기</h3>
      <ol>{instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
    </div>
  );
}
