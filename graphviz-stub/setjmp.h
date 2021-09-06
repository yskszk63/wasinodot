#ifndef	_SETJMP_H
#define	_SETJMP_H	1

typedef struct __jmp_buf_tag { int dummy } jmp_buf;

int setjmp (jmp_buf __env);
void longjmp (jmp_buf __env, int __val);

#endif
