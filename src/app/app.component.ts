import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  file: File | null = null;
  markdown: string = '';
  safeHtml: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {
    // サニタイズの初期値を設定
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml("");
  }

  // 別ファイルの方がパターンを試しやすいため
  // ここでmdファイルを読み込む
  // エラーなどは考えない
  onFileChange(event: any) {
    if (event.target.files.length > 0) {
      this.file = event.target.files[0];
      if (this.file) {
        this.readAsText(this.file).then(result => {
          this.markdown = result;
          // マークダウンからHTMLに変換
          const html = marked(this.markdown).toString();
          // サニタイズを実施してinnerHTMLで表示
          this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
        });
      }
    }
  }

  // ファイル読込み
  private readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }

  // 選択箇所をクリップボードにコピーする
  // クリップボードのコピーはnavigatorで非同期処理のため、
  // 選択イベントによるコピーは行なわずにボタン操作とする
  // イベントだと選択していくと多数コピー処理が実行される
  onClick() {
    console.log('onClick2');
    this.copyClipboard();
  }
  copyClipboard = async () => {
    const selection = await (window as any).getSelection();
    // 選択位置が複数ある場合に2以上となるが、マウスの選択だとCtlを押しても1つのみしか選択できない
    for (let i = 0; i < selection.rangeCount; i++) {
      const documentFragment: DocumentFragment = selection.getRangeAt(i).cloneContents();
      console.log(documentFragment);
      let text: string = ''; // 連結変数
      documentFragment.childNodes.forEach((d) => {
        // 現状はそのまま中身を連結しているが
        // 表のcsv変換などを入れたい
        text = text + '\n' + (d.textContent ? d.textContent : '');
      });
      console.log(text);
      try {
        // クリップボードにコピー
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error(error);
      }
    }
  };
}
