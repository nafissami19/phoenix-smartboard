import {Component,type ErrorInfo,type ReactNode} from 'react';

type Props={children:ReactNode;fallback?:(reset:()=>void)=>ReactNode};
type State={error:Error|null};

/** Catches render errors in a routed page and offers a friendly way out instead of a blank window. */
export class ErrorBoundary extends Component<Props,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:Error):State{return {error};}
  componentDidCatch(error:Error,info:ErrorInfo){if(import.meta.env.DEV)console.error('Page crashed',error,info.componentStack);}
  reset=()=>this.setState({error:null});
  render(){
    if(!this.state.error)return this.props.children;
    if(this.props.fallback)return this.props.fallback(this.reset);
    return <div role="alert" className="grid h-dvh w-full place-items-center bg-base p-4 text-ink">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-6 text-center shadow-2xl">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted">This screen hit an unexpected problem. Your saved lessons are safe; edits waiting to save are kept in the recovery journal.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="kn-focus rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={()=>location.reload()}>Reload</button>
          <button type="button" className="kn-focus rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-elevated" onClick={()=>{this.reset();location.hash='/library';}}>Back to library</button>
        </div>
      </div>
    </div>;
  }
}
