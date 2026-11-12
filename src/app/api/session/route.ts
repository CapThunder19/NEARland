import { NextResponse } from 'next/server';
import { issueSession, verifyLogin } from '../../../lib/nearServer';

type LoginBody = {
  accountId?: string;
  publicKey?: string;
  signature?: string;
  nonce?: string;
  issuedAt?: number;
};

/** Exchange a NEP-413 signed login message for a 24h session token. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.accountId || !body.publicKey || !body.signature || !body.nonce || typeof body.issuedAt !== 'number') {
    return NextResponse.json({ error: 'Invalid login payload.' }, { status: 400 });
  }

  const error = await verifyLogin({
    accountId: body.accountId,
    publicKey: body.publicKey,
    signature: body.signature,
    nonce: body.nonce,
    issuedAt: body.issuedAt,
  });
  if (error) return NextResponse.json({ error }, { status: 401 });

  return NextResponse.json({ token: issueSession(body.accountId), accountId: body.accountId });
}
