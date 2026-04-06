import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import axios from "axios"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        try {
          const res = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/login`,
            new URLSearchParams({
              username: credentials.username,
              password: credentials.password,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          )
          
          if (res.data?.access_token) {
            return {
              id: credentials.username,
              name: credentials.username,
              accessToken: res.data.access_token,
            }
          }
          return null
        } catch (e) {
          console.error(e)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
