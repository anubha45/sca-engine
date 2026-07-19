export async function POST(req){
    const body = await req.json();
    console.log(body.name);

    return Response.json({ message : `Hello, ${body.name}!` });
}

