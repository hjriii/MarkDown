import { Component, ViewChild, ElementRef } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


interface span {
  col: number,
  row: number
};

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
  text: string = '';

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
    this.copyClipboard2();
  }
  copyClipboard2 = async () => {
    const element = document.getElementById('insertDiv')?.firstChild;
    const text = await this.getTextContent(element);
    console.log(text);
    try {
      // クリップボードにコピー
      await navigator.clipboard.writeText(text);
      this.text = text;
    } catch (error) {
      console.error(error);
    }
  }

  getTextContent = async (element: ChildNode | null | undefined) => {
    let text: string = ''; // 連結変数
    while (element) {
      // テーブルは独自実装で整形する
      if (element.nodeName === 'TABLE') {
        const tables: string[][] = [];
        element.childNodes.forEach((child) => {
          // ヘッダを改行からタブ区切りに置き換える
          if (child.nodeName === 'THEAD') {
            this.setRow(child, tables, 'TH',);
          }
          // ボディを改行からタブ区切りに置き換える
          if (child.nodeName === 'TBODY') {
            this.setRow(child, tables, 'TD');
          }
        });
        console.log(tables);
        for (let rows of tables) {
          text = text + rows.join('\t') + '\n';
        }
      }
      // リストについては階層構造を考慮する
      else if ((element.nodeName === 'UL' || element.nodeName === 'OL' || element.nodeName === 'LI') && element.firstChild) {
        text = text + (await this.getTextContent(element.firstChild)).trim() + '\n';
      }
      // テーブルとリスト以外はtextContentで内容を引き出す
      else {
        let tmp = element.textContent;
        if (tmp) {
          // PREとDETAILS以外はブラウザに見えているものと同等とするため改行を除去
          if (element.nodeName !== 'PRE' && element.nodeName !== 'DETAILS') {
            tmp = tmp?.replace(/\n/g, '');
          }
          if (tmp.length > 0) {
            text = text + tmp + '\n';
          }
        }
        // Pでマークダウンが独立するので改行を入れる
        if (element.nodeName === 'P') {
          text = text + '\n';
        }
      }
      // 次のエレメントに移る
      element = element.nextSibling;
    }
    return text;
  }


  setRow = (child: ChildNode, tables: string[][], node: string) => {
    let rowIndex = 0;
    let maxRowIndex = 0;
    let spans: span[] = [];
    child.childNodes.forEach((row) => {
      if (row.nodeName === 'TR') {
        const rowStr: string[] = [];
        let colIndex = 0;
        let maxColIndex = 0;
        row.childNodes.forEach((column) => {
          if (column.nodeName === node) {
            if (column && column instanceof Element) {
              spans = this.setSpan(rowStr, spans, colIndex, rowIndex);
              let colSpan = 0;
              let rowSpan = 0;
              const colspanValue = column.getAttribute('colspan');
              if (colspanValue) {
                colSpan = parseInt(colspanValue, 10);
              }
              const rowspanValue = column.getAttribute('rowspan');
              if (rowspanValue) {
                rowSpan = parseInt(rowspanValue, 10);
              }
              for (let i = 1; i < colSpan; i++) {
                spans.push({ col: colIndex + i, row: rowIndex });
              }
              for (let j = 1; j < rowSpan; j++) {
                spans.push({ col: colIndex, row: rowIndex + j });
              }
              for (let i = 1; i < colSpan; i++) {
                for (let j = 1; j < rowSpan; j++) {
                  spans.push({ col: colIndex + i, row: rowIndex + j });
                }
              }
              let tmp = column.textContent;
              if (tmp) {
                rowStr.push(tmp);
              } else {
                rowStr.push('');
              }
              colIndex++;
            }
          }
        });
        spans = this.setSpan(rowStr, spans, colIndex, rowIndex);
        tables.push(rowStr);
        rowIndex++;
      }
    });
  }

  setSpan = (rowStr: string[], spans: span[], colIndex: number, rowIndex: number) => {
    const filter = spans.filter(span => span.row === rowIndex);
    const remove: span[] = [];
    let start = colIndex;
    filter.sort((s1, s2) => s1.col - s2.col).forEach(span => {
      if (span.col === start) {
        rowStr.push('');
        start++;
        remove.push(span);
      }
    })
    return spans.filter(span => !remove.includes(span));
  }

  search = async (target: any) => {
    if (target) {
      let text: string = ''; // 連結変数
      console.log(target.nativeElement.childNodes.entries);

      target.nativeElement.childNodes.forEach((d: any) => {
        // 現状はそのまま中身を連結しているが
        // 表のcsv変換などを入れたい
        // text = text + '\n' + (d.textContent ? d.textContent : '');
        console.log(d);
      });
    }
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
